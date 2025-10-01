import { checkBinsAndNotify } from "./services/binTracker";

setInterval(checkBinsAndNotify, 60 * 1000);