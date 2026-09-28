import type { Meta, StoryObj } from "@storybook/react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog"

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
}
export default meta

type Story = StoryObj<typeof Dialog>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
        Cite this
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit citation</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
}
