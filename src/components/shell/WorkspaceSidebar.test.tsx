import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

// Mock usePathname from next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("WorkspaceSidebar component", () => {
  it("renders all 5 core workspace navigation destinations", () => {
    render(<WorkspaceSidebar />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start interview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /interview history/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my progress/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("applies aria-current='page' to the active route", () => {
    render(<WorkspaceSidebar />);

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");

    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink).not.toHaveAttribute("aria-current");
  });

  it("calls onNavClick callback when link is clicked", () => {
    const handleNavClick = vi.fn();
    render(<WorkspaceSidebar onNavClick={handleNavClick} />);

    const historyLink = screen.getByRole("link", { name: /interview history/i });
    // Use dispatchEvent with preventDefault to avoid jsdom navigation warning
    fireEvent(
      historyLink,
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      })
    );
    expect(handleNavClick).toHaveBeenCalled();
  });
});
