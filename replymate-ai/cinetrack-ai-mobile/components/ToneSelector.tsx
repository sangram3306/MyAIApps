import { Tone, tones } from "../constants/tones";
import { ChipSelector } from "./ChipSelector";

type Props = {
  selectedTone: Tone;
  onSelect: (tone: Tone) => void;
};

export function ToneSelector({ selectedTone, onSelect }: Props) {
  return <ChipSelector options={tones} selectedValue={selectedTone} onSelect={onSelect} />;
}
