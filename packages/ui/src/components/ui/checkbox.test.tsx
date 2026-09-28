import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Checkbox } from "./checkbox"

describe("Checkbox", () => {
  it("toggles checked state via onCheckedChange", () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox onCheckedChange={onCheckedChange} />)
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onCheckedChange).toHaveBeenCalled()
  })
})
