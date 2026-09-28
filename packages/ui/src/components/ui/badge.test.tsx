import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge } from "./badge"

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText("New")).toBeInTheDocument()
  })

  it("applies the secondary variant's real compiled class", () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    expect(screen.getByText("Secondary").className).toContain("bg-secondary")
  })
})
