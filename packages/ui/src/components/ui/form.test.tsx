import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "./form"
import { Input } from "./input"
import { Label } from "./label"

describe("Form", () => {
  it("renders a label and a working control, styled identically to the standalone Input/Label", () => {
    render(
      <Form>
        <FormItem>
          <FormLabel>Author</FormLabel>
          <FormControl placeholder="Author" />
        </FormItem>
      </Form>
    )
    const control = screen.getByPlaceholderText("Author")
    fireEvent.change(control, { target: { value: "julian" } })
    expect(control).toHaveValue("julian")

    // Asserts the actual documented claim (form.tsx: "a field built from
    // Form looks identical to the same input used outside a Form") by
    // comparing against the real standalone components, rather than
    // hardcoding one of their classes here -- immune to either
    // component's own styling changing, which previously broke this test
    // for a change that broke nothing about Form's own composition.
    const { container: standaloneContainer } = render(<Input placeholder="standalone" />)
    const standaloneInput = standaloneContainer.querySelector("input")!
    expect(control.className).toBe(standaloneInput.className)

    const label = screen.getByText("Author")
    const { container: standaloneLabelContainer } = render(<Label>standalone</Label>)
    const standaloneLabel = standaloneLabelContainer.querySelector("label")!
    expect(label.className).toBe(standaloneLabel.className)
  })

  it("renders a description", () => {
    render(
      <Form>
        <FormItem>
          <FormLabel>Author</FormLabel>
          <FormControl placeholder="Author" />
          <FormDescription>Who is submitting this citation</FormDescription>
        </FormItem>
      </Form>
    )
    expect(screen.getByText("Who is submitting this citation")).toBeInTheDocument()
  })

  it("shows a validation message only after a real submit is rejected by native validation, not before", () => {
    const onFormSubmit = vi.fn()
    render(
      <Form onFormSubmit={onFormSubmit}>
        <FormItem>
          <FormLabel>Author</FormLabel>
          <FormControl placeholder="Author" required />
          <FormMessage match="valueMissing">Author is required</FormMessage>
        </FormItem>
        <button type="submit">Save</button>
      </Form>
    )

    expect(screen.queryByText("Author is required")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Save"))

    expect(screen.getByText("Author is required")).toBeInTheDocument()
    expect(onFormSubmit).not.toHaveBeenCalled()
  })
})
