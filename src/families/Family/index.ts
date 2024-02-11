import { Extrusion } from "../../geometries";
import { Profile } from "../../geometries/Profiles/Profile";

export type Geometries = {
  profile: Profile;
  extrusion: Extrusion;
};

export abstract class Family {
  public abstract toSubtract: Geometries;
  protected abstract create(...args: any[]): void;
  public abstract subtract(extrusion: Extrusion): void;
}
