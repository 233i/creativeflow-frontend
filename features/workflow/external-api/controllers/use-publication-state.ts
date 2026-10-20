"use client";
import * as publicationApi from "@/features/workflow/external-api/api";
import { useEffect, useRef, useState } from "react";
import type { PublicationProps } from "../publication-types";
export function usePublicationState({ onPendingChange }: PublicationProps) {
  const [deployments, setDeployments] = useState<publicationApi.WorkflowDeployment[]>([]);
  const [apiKeys, setApiKeys] = useState<publicationApi.WorkflowApiKey[]>([]);
  const [runs, setRuns] = useState<publicationApi.WorkflowExternalRunSummary[]>([]);
  const [description, setDescription] = useState("");
  const [maxConcurrency, setMaxConcurrency] = useState(2);
  const [keyName, setKeyName] = useState("Production");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"publish" | "key" | "disable" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exampleMode, setExampleMode] = useState<"stream" | "poll" | "agui">("stream");
  const mutationRef = useRef(false);
  const [inspectedRun, setInspectedRun] = useState<string | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [keyDialog, setKeyDialog] = useState(false);
  const dirtyRef = useRef(false);
  const readEpochRef = useRef(0);
  useEffect(() => {
    onPendingChange?.(
      formDirty || !!newSecret || (keyDialog && keyName !== "Production"),
      null,
      action !== null,
    );
    return () => onPendingChange?.(false, null, false);
  }, [formDirty, newSecret, keyDialog, keyName, action, onPendingChange]);

  return {
    deployments,
    setDeployments,
    apiKeys,
    setApiKeys,
    runs,
    setRuns,
    description,
    setDescription,
    maxConcurrency,
    setMaxConcurrency,
    keyName,
    setKeyName,
    newSecret,
    setNewSecret,
    loading,
    setLoading,
    action,
    setAction,
    error,
    setError,
    copied,
    setCopied,
    exampleMode,
    setExampleMode,
    mutationRef,
    inspectedRun,
    setInspectedRun,
    formDirty,
    setFormDirty,
    accessDenied,
    setAccessDenied,
    keyDialog,
    setKeyDialog,
    dirtyRef,
    readEpochRef,
  };
}
export type PublicationState = ReturnType<typeof usePublicationState>;
