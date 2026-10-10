"use client";

import { CircleAlert, Ruler } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { MAX_TILE_DIMENSION_MM, TILE_SIZE_PRESETS, TILE_UNIT } from "@/constants/tiles";
import { MAX_TILE_NAME_LENGTH, parseDimension } from "@/lib/tile";
import type { TileDraft, TileSizeOption } from "@/types/tile";

export type TileDetailsValue = Pick<TileDraft, "name" | "sizeOption" | "customWidth" | "customHeight">;

interface TileDetailsProps {
  value: TileDetailsValue;
  onChange: (patch: Partial<TileDetailsValue>) => void;
}

/** Largest preset dimension, used to scale the size swatches. */
const SWATCH_MAX_MM = 1200;

const INPUT =
  "h-11 w-full rounded-lg border bg-white px-3 text-sm text-ink transition-colors placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none";

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs text-red-700">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function SizeSwatch({ width, height, active }: { width: number; height: number; active: boolean }) {
  return (
    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center">
      <span
        className={`block rounded-[2px] border transition-colors ${active ? "border-accent bg-accent-muted/60" : "border-stone-400"}`}
        style={{
          width: `${(width / SWATCH_MAX_MM) * 100}%`,
          height: `${(height / SWATCH_MAX_MM) * 100}%`,
        }}
      />
    </span>
  );
}

interface DimensionInputProps {
  id: string;
  errorId: string;
  label: string;
  placeholder: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function DimensionInput({
  id,
  errorId,
  label,
  placeholder,
  value,
  error,
  onChange,
  onBlur,
}: DimensionInputProps) {
  return (
    <div className="flex-1">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-stone-600">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={1}
          max={MAX_TILE_DIMENSION_MM}
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          required
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={`${INPUT} pr-11 tabular-nums ${error ? "border-red-300" : "border-stone-300"}`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-stone-400"
        >
          {TILE_UNIT}
        </span>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

const OPTION =
  "flex min-w-36 flex-1 cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-200 has-focus-visible:ring-2 has-focus-visible:ring-accent has-focus-visible:ring-offset-2";

export default function TileDetails({ value, onChange }: TileDetailsProps) {
  const [touched, setTouched] = useState({ name: false, width: false, height: false });
  const ids = {
    name: useId(),
    nameError: useId(),
    width: useId(),
    widthError: useId(),
    height: useId(),
    heightError: useId(),
  };

  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  const nameError = touched.name && !value.name.trim() ? "Enter a name for this tile." : null;
  const isCustom = value.sizeOption === "custom";
  const widthResult = parseDimension(value.customWidth, "Width");
  const heightResult = parseDimension(value.customHeight, "Height");
  const widthError = isCustom && touched.width && "error" in widthResult ? widthResult.error : null;
  const heightError =
    isCustom && touched.height && "error" in heightResult ? heightResult.error : null;

  const selectSize = (sizeOption: TileSizeOption) => onChange({ sizeOption });

  return (
    <div className="space-y-8">
      <div>
        <label htmlFor={ids.name} className="mb-2 block text-sm font-medium text-ink">
          Tile name <span className="text-accent" aria-hidden="true">*</span>
        </label>
        <input
          id={ids.name}
          type="text"
          value={value.name}
          onChange={(event) => onChange({ name: event.target.value })}
          onBlur={() => touch("name")}
          placeholder="e.g. Petra Crema"
          maxLength={MAX_TILE_NAME_LENGTH}
          autoComplete="off"
          required
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? ids.nameError : undefined}
          className={`${INPUT} max-w-md ${nameError ? "border-red-300" : "border-stone-300"}`}
        />
        {nameError && <FieldError id={ids.nameError}>{nameError}</FieldError>}
      </div>

      <fieldset>
        <legend className="mb-2 flex w-full items-center justify-between gap-3 text-sm font-medium text-ink">
          <span>
            Tile size <span className="text-accent" aria-hidden="true">*</span>
          </span>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-normal text-stone-600">
            Unit: {TILE_UNIT}
          </span>
        </legend>

        <div className="flex flex-wrap gap-3">
          {TILE_SIZE_PRESETS.map((preset) => {
            const isSelected = value.sizeOption === preset.id;
            return (
              <label
                key={preset.id}
                className={`${OPTION} sm:flex-none ${
                  isSelected
                    ? "border-accent bg-accent-soft"
                    : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <input
                  type="radio"
                  name="tile-size"
                  value={preset.id}
                  checked={isSelected}
                  onChange={() => selectSize(preset.id)}
                  className="sr-only"
                />
                <SizeSwatch width={preset.width} height={preset.height} active={isSelected} />
                <span>
                  <span className="block text-sm font-medium text-ink tabular-nums">
                    {preset.width} × {preset.height}
                  </span>
                  <span className={`block text-xs ${isSelected ? "text-accent" : "text-stone-500"}`}>
                    {TILE_UNIT}
                  </span>
                </span>
              </label>
            );
          })}

          <label
            className={`${OPTION} sm:flex-none ${
              isCustom
                ? "border-accent bg-accent-soft"
                : "border-stone-200 bg-white hover:border-stone-400"
            }`}
          >
            <input
              type="radio"
              name="tile-size"
              value="custom"
              checked={isCustom}
              onChange={() => selectSize("custom")}
              className="sr-only"
            />
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center">
              <Ruler
                className={`size-5 ${isCustom ? "text-accent" : "text-stone-500"}`}
                strokeWidth={1.5}
              />
            </span>
            <span>
              <span className="block text-sm font-medium text-ink">Custom</span>
              <span className={`block text-xs ${isCustom ? "text-accent" : "text-stone-500"}`}>
                Enter size
              </span>
            </span>
          </label>
        </div>

        <div
          className={`grid transition-all duration-300 ease-out ${
            isCustom ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            {isCustom && (
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <DimensionInput
                    id={ids.width}
                    errorId={ids.widthError}
                    label="Width"
                    placeholder="600"
                    value={value.customWidth}
                    error={widthError}
                    onChange={(customWidth) => onChange({ customWidth })}
                    onBlur={() => touch("width")}
                  />
                  <span aria-hidden="true" className="mt-9 text-stone-400">
                    ×
                  </span>
                  <DimensionInput
                    id={ids.height}
                    errorId={ids.heightError}
                    label="Height"
                    placeholder="1200"
                    value={value.customHeight}
                    error={heightError}
                    onChange={(customHeight) => onChange({ customHeight })}
                    onBlur={() => touch("height")}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
