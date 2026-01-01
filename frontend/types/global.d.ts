declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    JSZip: any;
    aistudio?: AIStudio;
  }
}

export {};
