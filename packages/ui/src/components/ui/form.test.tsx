import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "./form"

describe("Form", () => {
  it("renders a label and a working control, styled like the standalone Input/Label", () => {
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
    expect(control.className).toContain("rounded-lg") // Input's own real compiled class
    const label = screen.getByText("Author")
    expect(label.className).toContain("leading-none") // Label's own real compiled class
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
