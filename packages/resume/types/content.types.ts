// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContentAttrs = Record<string, any>;

export type ContentMarks = {
  type: string;
  attrs?: ContentAttrs;
};

export type Content = {
  type?: string;
  text?: string;
  attrs?: ContentAttrs;
  marks?: ContentMarks[];
  content?: Content[];
};
