import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Label } from "./label"
import { Input } from "./input"

describe("Label", () => {
  it("renders its children", () => {
    render(<Label htmlFor="x">Author</Label>)
    expect(screen.getByText("Author")).toBeInTheDocument()
  })

  it("associates with its control via htmlFor, Label's actual purpose", () => {
    render(
      <div>
        <Label htmlFor="author-input">Author</Label>
        <Input id="author-input" />
      </div>
    )
    // getByLabelText only succeeds if the label/control association is real.
    expect(screen.getByLabelText("Author")).toBe(screen.getByRole("textbox"))
  })
})
