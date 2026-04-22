import { spawn } from "node:child_process";

export function openAirDropShare(filePath: string): Promise<void> {
  const script = `
    ObjC.import('AppKit');
    ObjC.import('Foundation');
    const url = $.NSURL.fileURLWithPath(${JSON.stringify(filePath)});
    const items = $.NSArray.arrayWithObject(url);
    const service = $.NSSharingService.sharingServiceNamed('com.apple.share.AirDrop.send');
    if (service.isNil()) throw new Error("AirDrop service unavailable");
    if (!service.canPerformWithItems(items)) throw new Error("AirDrop cannot share this file");
    service.performWithItems(items);
    $.NSRunLoop.mainRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(120));
  `;
  return new Promise((resolve, reject) => {
    const proc = spawn("osascript", ["-l", "JavaScript", "-e", script]);
    let stderr = "";
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `AirDrop failed (${code})`));
    });
  });
}
