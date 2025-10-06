import { checkBinsAndNotify } from "./services/binTracker.js";

setInterval(checkBinsAndNotify, 10 * 1000);