import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export interface PlanCardProps {
  /** The plan's name, also used in the button label. */
  name: string
  /** The price as shown, with currency and period. */
  price: string
  /** What the plan includes, one line each. */
  features: string[]
  /** Marks the plan the product recommends. */
  popular?: boolean
  /** Called when the visitor picks this plan. */
  onChoose?: () => void
}

/** One plan of the pricing page, with its features and a button to choose it. */
export function PlanCard({ name, price, features, popular = false, onChoose }: PlanCardProps) {
  return (
    <Card variant="outlined" sx={{ width: 280 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="h5" component="h2">
            {name}
          </Typography>
          {popular ? <Chip label="Popular" color="secondary" size="small" /> : null}
        </Stack>
        <Typography variant="h6" component="p" sx={{ mt: 1 }}>
          {price}
        </Typography>
        <List dense>
          {features.map((feature) => (
            <ListItem key={feature} disableGutters>
              {feature}
            </ListItem>
          ))}
        </List>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button fullWidth variant={popular ? 'contained' : 'outlined'} onClick={onChoose}>
          Choose {name}
        </Button>
      </CardActions>
    </Card>
  )
}
