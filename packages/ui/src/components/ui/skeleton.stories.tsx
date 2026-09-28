import type { Meta, StoryObj } from "@storybook/react"
import { Skeleton } from "./skeleton"

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
}
export default meta

type Story = StoryObj<typeof Skeleton>

export const Default: Story = {
  render: () => <Skeleton className="h-4 w-32" />,
}

export const LoadingCard: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-40" />
    </div>
  ),
}
