"use client";
import {
  buildWorkflowAgUiCurl,
  buildWorkflowCurl,
} from "@/features/workflow/external-api/call-example";
import { useMemo } from "react";
import type { PublicationProps } from "../publication-types";
import { usePublicationCommands } from "./use-publication-commands";
import { usePublicationQuery } from "./use-publication-query";
import { usePublicationState } from "./use-publication-state";
export function usePublicationController(props: PublicationProps) {
  const state = usePublicationState(props);
  const query = usePublicationQuery(props, state);
  const commands = usePublicationCommands(props, state, query);
  const { workflowId, updatedAt, manifest } = props;
  const { deployments, exampleMode } = state;
  const current = deployments.find((item) => item.status === "published");
  const unpublished = current
    ? new Date(updatedAt).getTime() > new Date(current.publishedAt).getTime()
    : true;
  const contract = current
    ? { inputs: current.inputs ?? [], outputs: current.outputs ?? [] }
    : manifest;
  const sample = useMemo(
    () =>
      exampleMode === "agui"
        ? buildWorkflowAgUiCurl(workflowId, contract.inputs)
        : buildWorkflowCurl(
            workflowId,
            current ? (current.inputs ?? []) : manifest.inputs,
            exampleMode === "stream",
          ),
    [current, manifest.inputs, workflowId, exampleMode, contract.inputs],
  );

  return { ...props, ...state, ...query, ...commands, current, unpublished, contract, sample };
}
export type PublicationController = ReturnType<typeof usePublicationController>;
