export interface SubtitleSegment {
  text: string;
  className?: string;
}

export interface SubtitleOption {
  segments: SubtitleSegment[];
}

export interface HomeCopyConfig {
  subtitleOptions: SubtitleOption[];
}
