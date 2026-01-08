type PathRequestCount = {
  path: string;
  requests: number;
};

type AnalyticsResult = {
  host: string;
  period: {
    start: string;
    end: string;
  };
  totalRequests: number;
  paths: PathRequestCount[];
};

type GraphQLResponse = {
  data?: {
    viewer: {
      zones: Array<{
        httpRequestsAdaptiveGroups: Array<{
          count: number;
          dimensions: {
            clientRequestPath: string;
          };
        }>;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
};

export class CloudflareAnalyticsClient {
  private apiToken: string;
  private zoneId: string;
  private readonly endpoint = "https://api.cloudflare.com/client/v4/graphql";

  constructor() {
    const token = process.env.CF_API_TOKEN;
    const zoneId = process.env.CF_ZONE_ID;

    if (!token) {
      throw new Error("CF_API_TOKEN environment variable must be set");
    }
    if (!zoneId) {
      throw new Error("CF_ZONE_ID environment variable must be set");
    }

    this.apiToken = token;
    this.zoneId = zoneId;
  }

  async getRequestsByPath(
    host: string,
    sortOrder: "most" | "least" = "most",
    limit: number = 50,
    days: number = 7
  ): Promise<AnalyticsResult> {
    const endDate = new Date();
    const startDate = new Date();
    const orderBy = sortOrder === "most" ? "count_DESC" : "count_ASC";
    startDate.setDate(startDate.getDate() - days);

    const query = `
			query GetHttpRequestsByPath($zoneTag: String!, $startDate: Time!, $endDate: Time!, $host: String!) {
				viewer {
					zones(filter: { zoneTag: $zoneTag }) {
						httpRequestsAdaptiveGroups(
							filter: {
								datetime_geq: $startDate
								datetime_leq: $endDate
								clientRequestHTTPHost: $host
								clientRequestPath_like: "%/extensions%"
							}
							limit: ${limit}
							orderBy: [${orderBy}]
						) {
							count
							dimensions {
								clientRequestPath
							}
						}
					}
				}
			}
		`;

    const variables = {
      zoneTag: this.zoneId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      host: host,
    };

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.status} ${response.statusText}`);
    }

    const result: GraphQLResponse = await response.json();

    if (result.errors?.length) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`);
    }

    const groups = result.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];

    let paths: PathRequestCount[] = groups.map((group) => ({
      path: group.dimensions.clientRequestPath,
      requests: group.count,
    }));

    const totalRequests = groups.reduce((sum, group) => sum + group.count, 0);

    return {
      host,
      period: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      },
      totalRequests,
      paths,
    };
  }
}
