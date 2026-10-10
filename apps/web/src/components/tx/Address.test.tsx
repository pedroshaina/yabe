import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Address } from "@/components/tx/Address";

const LONG = "tb1pzczwmt4kenu8j0avnhpyefp3gph32w2syuym8p8qxs5ulxudus3sqmsj75";

describe("Address", () => {
  it("is plain text when it's short enough to show whole", () => {
    render(<Address address="tb1qinputone" />);
    expect(screen.getByText("tb1qinputone")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is a button named by the whole address, showing the short form too", () => {
    render(<Address address={LONG} />);
    const button = screen.getByRole("button", { name: LONG });
    expect(button).toHaveTextContent("tb1pzczwmt…qmsj75");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAccessibleDescription("Show full address");
  });

  it("opens and closes from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Address address={LONG} />);
    const button = screen.getByRole("button", { name: LONG });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAccessibleDescription("Show less");
    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
