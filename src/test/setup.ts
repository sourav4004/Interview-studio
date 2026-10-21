import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

// Mock next/link to prevent jsdom navigation warning during link click tests
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    [key: string]: unknown;
  }) => {
    return React.createElement(
      "a",
      {
        href,
        onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          onClick?.(e);
        },
        ...rest,
      },
      children
    );
  },
}));
