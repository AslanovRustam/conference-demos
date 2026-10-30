import rawConfig from '../../games.config.json'
import { validateConfig } from './games'

/** games.config.json, validated once at startup. */
export const config = validateConfig(rawConfig)
