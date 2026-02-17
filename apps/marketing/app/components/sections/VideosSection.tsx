"use client";

import { VideosSection, type VideosSectionContent } from "@trail/ui/marketing";
import { videos } from "../../data/videos";

interface VideoShowcasesProps {
  content?: VideosSectionContent;
}

export default function VideoShowcases({ content }: VideoShowcasesProps) {
  return <VideosSection content={content ?? videos} />;
}
