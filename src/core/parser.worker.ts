import { parseHTML } from "@ainx/hylo-core";

interface ParseRequest {
  version: number;
  html: string;
}

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { version, html } = event.data;
  self.postMessage({ version, result: parseHTML(html) });
};
