import type { Meta, StoryObj } from "@storybook/react"
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "./form"
import { Button } from "./button"

const meta: Meta<typeof Form> = {
  title: "UI/Form",
  component: Form,
}
export default meta

type Story = StoryObj<typeof Form>

export const Default: Story = {
  render: () => (
    <Form>
      <FormItem>
        <FormLabel>Author</FormLabel>
        <FormControl placeholder="julian" />
        <FormDescription>Who is submitting this citation.</FormDescription>
      </FormItem>
    </Form>
  ),
}

export const RealValidationOnSubmit: Story = {
  render: () => (
    <Form>
      <FormItem>
        <FormLabel>Author</FormLabel>
        <FormControl placeholder="julian" required />
        <FormMessage match="valueMissing">Author is required</FormMessage>
      </FormItem>
      <Button type="submit" className="mt-2">
        Save
      </Button>
    </Form>
  ),
}
