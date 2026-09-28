import { describe, expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Textarea } from "./textarea"

describe("Textarea", () => {
  it("renders and accepts typed input", () => {
    render(<Textarea placeholder="Reasoning" />)
    const textarea = screen.getByPlaceholderText("Reasoning")
    fireEvent.change(textarea, { target: { value: "looks correct" } })
    expect(textarea).toHaveValue("looks correct")
  })
})
