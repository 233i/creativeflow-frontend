"use client";
import { ImageGenNode } from "@/features/canvas/nodes/image-gen-node";
import { ImageNode } from "@/features/canvas/nodes/image-node";
import { TextNode } from "@/features/canvas/nodes/text-node";
import { VideoGenNode } from "@/features/canvas/nodes/video-gen-node";
import { VideoNode } from "@/features/canvas/nodes/video-node";

export const NODE_TYPES = {
  text: TextNode,
  image: ImageNode,
  video: VideoNode,
  imageGen: ImageGenNode,
  videoGen: VideoGenNode,
};
