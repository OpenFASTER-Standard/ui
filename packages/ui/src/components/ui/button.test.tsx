import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button } from "./button"

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText("Click me")).toBeInTheDocument()
  })

  it("forwards onClick", () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    fireEvent.click(screen.getByText("Click me"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("applies the destructive variant's real compiled class", () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByText("Delete").className).toContain("bg-destructive")
  })
})
