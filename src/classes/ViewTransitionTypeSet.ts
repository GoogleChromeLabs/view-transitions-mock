import { ViewTransitionTypeSet as ViewTransitionTypeSetInterface } from "../types";

class ViewTransitionTypeSet
  extends Set<string>
  implements ViewTransitionTypeSetInterface
{
  constructor() {
    super();
  }
}
export { ViewTransitionTypeSet };
