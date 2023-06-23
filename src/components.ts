import writeQR from '@paulmillr/qr';
import readQR from '@paulmillr/qr/decode';


  const GenerateQRCodeComponent =
  {
    schema:
    {
      "tags": ['default'],
      "componentKey": "generateQR",
      "operation": {

        "schema": {
          "title": "GenerateQR",
          "type": "object",
          required:["text"],
          "properties": {
            "text": {
              "title": "Text",
              "type": "string",
              "x-type": "text",
              "description": `The Text to encode on the QR Code`
            },
            "scale": {
              "title": "Scale",
              "type": "number",
              "default": 8,
              "minimum": 1,
              "maximum": 20,
              "description": `Number Pixels to encode each block`
            },
            "border": {
              "title": "Border",
              "type": "number",
              "default": 2,
              "minimum": 1,
              "maximum": 10,
              "description": `Number of Border Pixels`
            },
            "mask": {
              "title": "QR Mask",
              "type": "number",
              "default": 0,
              "minimum": 0,
              "maximum": 7,
              "description": `QR Code Mask Number`
            },
            "version": {
              "title": "QR Version",
              "type": "number",
              "default": 0,
              "minimum": 0,
              "maximum": 40,
              "description": `QR Version`
            },
            "ecc":
            {
              "title": "Error Correction",
              "type": "string",
            },
            "encoding":
            {
              "title": "Encoding",
              "type": "string",
              "x-type": "text",
              "description": `The Encoding to use`
            }
          },
        },
        "responseTypes": {
          "200": {
            "schema": {
              "required": [

              ],
              "type": "string",
              "properties": {
                "gif": {
                  "title": "Gif",
                  "type": "object",
                  "x-type": "image",
                  "description": "The Generated QRCode as Gif"
                },
                "svg": {
                  "title": "SVG",
                  "type": "string",
                  "x-type": "text",
                  "description": "The Generated QRCode as SVG"
                },
              },
            },
            "contentType": "application/json"
          },
        },
        "method": "X-CUSTOM"
      },
      patch:
      {
        "title": "Generate QR Code",
        "category": "Utilities",
        "summary": "Generates a QR Code from the provided text",
        "meta":
        {
          "source":
          {
            "summary": "QRCode Decoding via @paulmillr.qr",
            links:
            {
              "Github": "https://github.com/paulmillr/qr",
            }
          }
        },
        "inputs":
        {
          "scale": {
            control:
            {
              type: 'AlpineNumWithSliderComponent',
            }
          },
          "ecc":
          {
            choices: ['low', 'medium', 'quartile', 'high'] ,
            default: "medium"
          },
          "encoding":
          {
            choices: ['numeric', 'alphanumeric', 'byte'],
            default: "alphanumeric",
          },
          "version": {
            step: 1,
            control:
            {
              type: 'AlpineNumWithSliderComponent',
            }
          },
          "mask": {
            step: 1,
            control:
            {
              type: 'AlpineNumWithSliderComponent',
            }
          },
          "border": {
            step: 1,
            control:
            {
              type: 'AlpineNumWithSliderComponent',
            }
          },

        }






      }
    },
    functions: {
      _exec: async (payload, ctx) =>
      {
        /*type QrOpts = {
          ecc?: 'low', 'medium', 'quartile', 'high'; // Default: 'medium'. Low: 7%, medium: 15%, quartile: 25%, high: 30%
          encoding?: 'numeric', 'alphanumeric', 'byte', 'kanji', 'eci'; // Force specific encoding. Kanji and ECI are not supported yet
          version?: number; // 1..40, QR code version
          mask?: number; // 0..7, mask number
          border?: number; // Border size, default 2.
          scale?: number; // Scale to this number. Scale=2 -> each block will be 2x2 pixels
        }*/

        const opts = {
          scale: payload.scale || 4,
          ecc: payload.ecc || 'medium',
          border: payload.border || 2,
          version: payload.version || undefined
        }


        // Todo: only if socket is connected
        const gifBytes = writeQR(payload.text, 'gif', opts);
        const gif = await ctx.app.cdn.putTemp(Buffer.from(gifBytes), {mimeType: 'image/gif'})

        const svg = writeQR(payload.text, 'svg', opts);

        return {gif, svg}
      }
    }
  }

  const DecodeQRCodeComponent =
  {
    schema:
    {
      "tags": ['default'],
      "componentKey": "decodeQR",
      "operation": {

        "schema": {
          "title": "decodeQR",
          "type": "object",
          required:["image"],
          "properties": {
            "image": {
              "title": "Image",
              "type": "object",
              "x-type": "image",
              "description": `The QR code image to decode`
            }
          },
        },
        "responseTypes": {
          "200": {
            "schema": {
              "required": [

              ],
              "type": "string",
              "properties": {
                "text": {
                  "title": "Text",
                  "type": "string",
                  "x-type": "text",
                  "description": "The text"
                }
              },
            },
            "contentType": "application/json"
          },
        },
        "method": "X-CUSTOM"
      },
      patch:
      {
        "title": "Decode QR Code",
        "category": "Utilities",
        "summary": "Decode a QR Code to text",
        "meta":
        {
          "source":
          {
            "summary": "QRCode Decoding via @paulmillr.qr",
            links:
            {
              "Github": "https://github.com/paulmillr/qr",
            }
          }
        },
        inputs:
        {
          "image":
          {
            control:
            {
              type: 'AlpineLabelComponent',
            }
          }
        }

      }
    },
    functions: {
      _exec: async (payload, ctx) =>
      {
        if (payload.image)
        {

          const gif = (await ctx.app.cdn.get(payload.image))

          console.log(gif)

          const decoded = readQR({ height: gif.meta.height, width: gif.meta.width, data: new Uint8Array(gif.data) });

          return {text: decoded}
        }
        return {}
      }
    }
  }

let components = [GenerateQRCodeComponent]


export default (FactoryFn: any) =>
{
  return components.map((c) => FactoryFn(c.schema, c.functions))
}
