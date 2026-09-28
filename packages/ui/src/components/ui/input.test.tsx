import { describe, expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Input } from "./input"

describe("Input", () => {
  it("renders and accepts typed input", () => {
    render(<Input placeholder="Fact key" />)
    const input = screen.getByPlaceholderText("Fact key")
    fireEvent.change(input, { target: { value: "fact-1" } })
    expect(input).toHaveValue("fact-1")
  })
})
