import * as indulgent from 'indulgent';
declare global {
  // oxlint-disable-next-line vars-on-top
  var __indulgentData: {
    currentId: number;
  };
  // oxlint-disable-next-line vars-on-top
  var indulgent: typeof indulgent & {
    init: (opts?: { debug?: boolean }) => void;
  };
}

export {};
