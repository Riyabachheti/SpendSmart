import { render, screen } from "@testing-library/react";

import { CategoryIcon } from "./category-icon";

describe("CategoryIcon", () => {
  it("maps the briefcase category key to an SVG icon", () => {
    const { container } = render(<CategoryIcon icon="briefcase" />);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByText("briefcase")).not.toBeInTheDocument();
  });

  it("uses a stable SVG fallback for unknown word keys", () => {
    const { container } = render(<CategoryIcon icon="unknown-key" />);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByText("unknown-key")).not.toBeInTheDocument();
  });

  it("preserves intentional custom glyphs", () => {
    render(<CategoryIcon icon="🌱" />);

    expect(screen.getByText("🌱")).toBeInTheDocument();
  });
});
