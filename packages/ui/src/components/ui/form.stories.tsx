import type { Meta, StoryObj } from "@storybook/react"
import { Form, FormItem, FormLabel, FormControl, FormMessage } from "./form"

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
      </FormItem>
    </Form>
  ),
}

export const WithValidationMessage: Story = {
  render: () => (
    <Form>
      <FormItem>
        <FormLabel>Author</FormLabel>
        <FormControl placeholder="julian" />
        <FormMessage match>Author is required</FormMessage>
      </FormItem>
    </Form>
  ),
}
