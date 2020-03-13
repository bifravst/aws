import { Location, Cell } from '../geolocateCell'

export type CellGeoLocation = Cell & {
	located: boolean
} & Partial<Location>
