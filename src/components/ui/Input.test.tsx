import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Input } from "./Input";
import { Label } from "./Label";
import { HelperText, ErrorMessage } from "./FormHelper";

describe("Input component", () => {
  it("renders with basic text attributes and receives value", () => {
    const handleChange = vi.fn();
    render(
      <div>
        <Label htmlFor="test-input">Test Label</Label>
        <Input id="test-input" placeholder="Enter text" onChange={handleChange} />
      </div>
    );

    const input = screen.getByLabelText("Test Label");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Enter text");

    fireEvent.change(input, { target: { value: "Hello world" } });
    expect(handleChange).toHaveBeenCalled();
  });

  it("sets aria-invalid and links aria-describedby on error", () => {
    render(
      <div>
        <Label htmlFor="email-input">Email</Label>
        <Input
          id="email-input"
          error
          errorMessageId="email-error"
          helperTextId="email-helper"
        />
        <HelperText id="email-helper">Enter college email</HelperText>
        <ErrorMessage id="email-error">Invalid email address</ErrorMessage>
      </div>
    );

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-error email-helper");
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email address");
  });

  it("respects disabled state", () => {
    render(<Input disabled placeholder="Disabled input" />);
    const input = screen.getByPlaceholderText("Disabled input");
    expect(input).toBeDisabled();
    expect(input).toHaveClass("disabled:cursor-not-allowed");
  });
});
