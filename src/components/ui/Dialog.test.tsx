import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog component", () => {
  it("does not render when isOpen is false", () => {
    render(
      <Dialog isOpen={false} onClose={vi.fn()} title="Test Dialog">
        <p>Dialog body content</p>
      </Dialog>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders when isOpen is true with ARIA attributes and title", () => {
    render(
      <Dialog
        isOpen={true}
        onClose={vi.fn()}
        title="Test Modal Title"
        description="Modal description text"
      >
        <p>Modal body content</p>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Test Modal Title")).toBeInTheDocument();
    expect(screen.getByText("Modal description text")).toBeInTheDocument();
    expect(screen.getByText("Modal body content")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={handleClose} title="Test Title">
        <p>Content</p>
      </Dialog>
    );

    const closeBtn = screen.getByRole("button", { name: /close dialog/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={handleClose} title="Escape Test">
        <p>Content</p>
      </Dialog>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
