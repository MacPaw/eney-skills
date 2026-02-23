import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

const mdxSource = docs.toFumadocsSource();

export const source = loader({
  baseUrl: '/docs',
  source: {
    // fumadocs-mdx returns files as a lazy function
    files: typeof mdxSource.files === 'function'
      ? (mdxSource.files as CallableFunction)()
      : mdxSource.files,
  },
});
