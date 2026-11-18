(function (global) {
  "use strict";
  class ExecutionController {
    constructor(onChange = () => {}) { this.onChange = onChange; this.current = null; this.sequence = 0; }
    start() {
      if (this.current) return null;
      const run = { id: ++this.sequence, paused: false, cancelled: false, waiters: [] };
      this.current = run;
      this.onChange(run);
      return run;
    }
    togglePause() {
      const run = this.current;
      if (!run) return;
      run.paused = !run.paused;
      if (!run.paused) run.waiters.splice(0).forEach(resolve => resolve());
      this.onChange(run);
    }
    stop() {
      const run = this.current;
      if (!run) return;
      run.cancelled = true;
      run.waiters.splice(0).forEach(resolve => resolve());
      this.onChange(run);
    }
    async checkpoint(run) {
      if (!run || run.cancelled || this.current !== run) return false;
      while (run.paused && !run.cancelled) await new Promise(resolve => run.waiters.push(resolve));
      return !run.cancelled && this.current === run;
    }
    finish(run) {
      if (this.current !== run) return;
      this.current = null;
      this.onChange(null);
    }
  }
  global.ExecutionController = ExecutionController;
  if (typeof module !== "undefined" && module.exports) module.exports = ExecutionController;
})(typeof window !== "undefined" ? window : globalThis);
