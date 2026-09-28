import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Label } from "./label"

describe("Label", () => {
  it("renders its children", () => {
    render(<Label htmlFor="x">Author</Label>)
    expect(screen.getByText("Author")).toBeInTheDocument()
  })
})
