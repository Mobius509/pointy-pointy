/* eslint-disable @next/next/no-img-element */
import type { KidProfile } from "@/lib/v2/data";
import { avatarSrc } from "@/lib/avatar";
import {
  createKidAction,
  deleteKidAction,
  resetKidPinAction,
  updateKidAction,
} from "../_actions/kids";
import { SectionPill } from "./ui";
import { AvatarPicker } from "../../_components/AvatarPicker";

// Settings sub-card for managing kids (create / edit / reset PIN / delete).
export function KidsAdmin({
  slug,
  kids,
}: {
  slug: string;
  kids: KidProfile[];
}) {
  return (
    <div className="space-y-6">
      <section className="card-warm">
        <SectionPill>Add a kid</SectionPill>
        <p className="text-[#C3A38A] mt-2">
          Each kid gets their own PIN to unlock their checklist.
        </p>
        <form action={createKidAction} className="mt-4 grid gap-4">
          <input type="hidden" name="slug" value={slug} />
          <div>
            <label className="label-warm">Avatar</label>
            <AvatarPicker />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label-warm" htmlFor="kid-new-name">
                Name
              </label>
              <input
                id="kid-new-name"
                name="name"
                required
                maxLength={40}
                className="input-warm"
                placeholder="Sam"
              />
            </div>
            <div>
              <label className="label-warm" htmlFor="kid-new-pin">
                PIN (4–8 digits)
              </label>
              <input
                id="kid-new-pin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                minLength={4}
                maxLength={8}
                required
                className="input-warm"
              />
            </div>
            <div>
              <label className="label-warm" htmlFor="kid-new-pin2">
                Confirm PIN
              </label>
              <input
                id="kid-new-pin2"
                name="confirm_pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                minLength={4}
                maxLength={8}
                required
                className="input-warm"
              />
            </div>
          </div>
          <div>
            <button type="submit" className="btn-warm-primary">
              Add kid
            </button>
          </div>
        </form>
      </section>

      <section className="card-warm">
        <SectionPill>Your kids</SectionPill>
        {kids.length === 0 ? (
          <p className="mt-4 text-slate-500 italic">No kids yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {kids.map((k) => (
              <li
                key={k.id}
                className="rounded-2xl ring-1 ring-[#F1D1BD]/70 bg-[#FFFDF9] p-3"
              >
                <form action={updateKidAction} className="grid gap-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={k.id} />
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarSrc(k.avatar_emoji)}
                      alt=""
                      aria-hidden
                      className="w-12 h-12 object-contain flex-shrink-0"
                    />
                    <div className="flex-1">
                      <label className="label-warm">Name</label>
                      <input
                        name="name"
                        defaultValue={k.name}
                        required
                        maxLength={40}
                        className="input-warm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label-warm">Avatar</label>
                    <AvatarPicker defaultValue={k.avatar_emoji} />
                  </div>
                  <div>
                    <button type="submit" className="btn-warm-secondary">
                      Save
                    </button>
                  </div>
                </form>

                <details className="mt-3">
                  <summary className="text-[#D45B00] font-semibold cursor-pointer">
                    Reset PIN
                  </summary>
                  <form
                    action={resetKidPinAction}
                    className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  >
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={k.id} />
                    <div>
                      <label className="label-warm">New PIN</label>
                      <input
                        name="pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        minLength={4}
                        maxLength={8}
                        required
                        className="input-warm"
                      />
                    </div>
                    <div>
                      <label className="label-warm">Confirm</label>
                      <input
                        name="confirm_pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        minLength={4}
                        maxLength={8}
                        required
                        className="input-warm"
                      />
                    </div>
                    <button type="submit" className="btn-warm-secondary">
                      Reset
                    </button>
                  </form>
                </details>

                <form action={deleteKidAction} className="mt-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={k.id} />
                  <button
                    type="submit"
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Delete kid (also removes their history)
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
