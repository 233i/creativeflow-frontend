import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChipRow, ModelPicker, useSelection } from "@/features/ai/model-picker";
import { useAiStore } from "@/features/ai/store";
import type { AiProvider } from "@/features/ai/types";

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string) => key,
}));

function provider(id = "first"): AiProvider {
  return {
    id,
    name: `${id} provider`,
    type: "openai-images",
    baseUrl: "https://models.example/v1",
    enabled: true,
    hasApiKey: true,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    models: [
      {
        id: `${id}-image`,
        modelKey: `${id}-image`,
        name: `${id} image`,
        enabled: true,
        category: "image",
      },
    ],
  };
}

beforeEach(() => {
  useAiStore.setState({ providers: [] });
});

describe("shared media model picker", () => {
  it("shows the configuration hint when no provider is usable", () => {
    useAiStore.setState({ providers: [{ ...provider(), hasApiKey: false }] });
    render(<ModelPicker category="image" onChange={vi.fn()} />);

    expect(screen.getByText("node.noProvider")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("filters disabled providers and clears the old model when changing providers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    useAiStore.setState({
      providers: [provider(), provider("second"), { ...provider("disabled"), enabled: false }],
    });
    render(
      <ModelPicker category="image" providerId="first" modelId="first-image" onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /node\.provider/ }));
    expect(screen.queryByRole("option", { name: "disabled provider" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "second provider" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      providerId: "second",
      modelId: undefined,
    });
  });

  it("offers only enabled models in the requested category and keeps the selected provider", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const first = provider();
    first.models.push(
      { ...first.models[0], id: "disabled", name: "disabled image", enabled: false },
      { ...first.models[0], id: "video", name: "video model", category: "video" },
      { ...first.models[0], id: "alternate", name: "alternate image" },
    );
    useAiStore.setState({ providers: [first] });
    render(<ModelPicker category="image" providerId="first" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /node\.model/ }));
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.queryByRole("option", { name: "disabled image" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "video model" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "alternate image" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      providerId: "first",
      modelId: "alternate",
    });
  });

  it("disables model selection until a provider is selected", () => {
    useAiStore.setState({ providers: [provider()] });
    render(<ModelPicker category="image" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /node\.model/ })).toBeDisabled();
  });
});

describe("shared media selection", () => {
  it("resolves the model protocol override and invalidates a disabled model", () => {
    const first = provider();
    first.models[0].type = "gemini";
    useAiStore.setState({ providers: [first] });
    const { result } = renderHook(() => useSelection("first", "first-image"));
    expect(result.current).toMatchObject({ provider: first, protocol: "gemini" });

    act(() => {
      useAiStore.setState({
        providers: [{ ...first, models: [{ ...first.models[0], enabled: false }] }],
      });
    });
    expect(result.current).toBeNull();
  });

  it("does not resolve a model from another provider or a disabled provider", () => {
    useAiStore.setState({ providers: [provider(), { ...provider("second"), enabled: false }] });
    const { result, rerender } = renderHook(({ id }) => useSelection(id, "second-image"), {
      initialProps: { id: "first" },
    });
    expect(result.current).toBeNull();
    rerender({ id: "second" });
    expect(result.current).toBeNull();
  });

  it("keeps parameter options mutually exclusive and emits the selected value once", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChipRow label="ratio" options={["1:1", "16:9"]} value="1:1" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "1:1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "16:9" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "16:9" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("16:9");
  });
});
