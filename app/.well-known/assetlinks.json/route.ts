import { NextResponse } from 'next/server';

export async function GET() {
  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.fiabono.app",
        sha256_cert_fingerprints: [
          "74:B4:03:2F:18:E7:53:79:4E:02:81:84:57:3A:76:0E:5D:86:A1:EF:AF:30:D8:06:62:53:00:0B:BE:3D:C5:E5"
        ]
      }
    }
  ];

  return NextResponse.json(assetlinks, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
