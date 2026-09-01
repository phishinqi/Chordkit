self.onmessage = (event: MessageEvent<{ source: string; context: unknown }>) => {
  try {
    const callback = new Function('context', event.data.source) as (context: unknown) => unknown;
    self.postMessage({ ok: true, value: callback(event.data.context) });
  } catch (reason) {
    self.postMessage({ ok: false, error: reason instanceof Error ? reason.message : String(reason) });
  }
};