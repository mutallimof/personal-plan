# OCR evaluation

Measures how well the receipt reader works on your own photos, with the same photo helper and OCR settings as the app. Every photo is read twice: **original** (only resized) and **helper** (crop to the paper, straighten, contrast), so you can see whether the helper really helps on your receipts.
Everything runs on your machine. Your photos never leave it and are ignored by git.

## Run it

1. Put photos in `scripts/ocr-eval/samples/` (`.jpg` or `.png`).
2. Next to each photo, write what the receipt really says, one line per receipt line, in a file with the same name plus `.expected.json`:

   ```
   samples/
     rewe-2026-03-12.jpg
     rewe-2026-03-12.expected.json
   ```

   ```json
   {
     "lines": [
       "H-MILCH 1,5% 1L 0,99 B",
       "BANANEN 1,89 B",
       "SPAGHETTI 500G 1,29 B"
     ]
   }
   ```

   A plain list of strings works too. Type the lines the way they are printed. You can leave out header and footer lines.
3. Run:

   ```sh
   npm run ocr:eval                      # every image in samples/
   npm run ocr:eval -- --threshold       # the helper also reduces to black and white
   npm run ocr:eval -- --verbose         # also list the lines that were read exactly
   npm run ocr:eval -- some/other/folder
   ```

The first run downloads the German language data (about 10 MB) into `scripts/ocr-eval/.cache/`.

## Reading the result

```
rewe-2026-03-12.jpg
  close   BANANEN 1,89 B
          read: BANANEN 1,69 B
  MISSED  SPAGHETTI 500G 1,29 B
          read: (nothing close)
  lines: 1 exact, 1 close, 1 missed of 3  (exact 33.3%, exact or close 66.7%, character errors 12.5%)
  products found: 2 of 3
```

- **exact**: the line was read the same, ignoring case and spacing.
- **close**: at least 85% similar. Usually one wrong digit or letter.
- **MISSED**: nothing close enough was read.
- **character errors**: edits needed divided by the characters you expected. Lower is better.
- **products found**: product names the parser finds in your expected lines that also appear in the OCR text. This is the number that matters for the pantry, because a wrong price does not matter but a wrong name does.
- **extra lines read**: lines OCR produced that match none of your expected lines (noise, or lines you left out).

The first line under each photo shows what the photo checks measured (brightness, sharpness, or the problem found),
and whether the helper cropped and by how much it turned the image. Each photo is then scored twice, and the end shows
both totals and the difference. If the helper does not help on your photos, the last line says so; in the app, the
*Use original* switch on the preview screen reads the untouched photo. Compare runs with and without `--threshold` to
see whether black and white suits your receipts.
