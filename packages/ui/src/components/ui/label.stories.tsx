import type { Meta, StoryObj } from "@storybook/react"
import { Label } from "./label"
import { Input } from "./input"

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
}
export default meta

type Story = StoryObj<typeof Label>

export const Default: Story = {
  args: { children: "Author" },
}

export const WithControl: Story = {
  render: () => (
    <div className="grid gap-2">
      <Label htmlFor="author-story">Author</Label>
      <Input id="author-story" placeholder="julian" />
    </div>
  ),
}

export const WithDisabledControl: Story = {
  render: () => (
    <div className="grid gap-2">
      <Label htmlFor="author-story-disabled" className="peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
        Author
      </Label>
      <Input id="author-story-disabled" placeholder="julian" disabled className="peer" />
    </div>
  ),
}
