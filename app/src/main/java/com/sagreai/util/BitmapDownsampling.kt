package com.sagreai.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.max

private const val MAX_BITMAP_DIMENSION = 2000

@Suppress("DEPRECATION")
suspend fun Uri.toDownsampledBitmap(context: Context, maxDimension: Int = MAX_BITMAP_DIMENSION): Bitmap? =
    withContext(Dispatchers.IO) {
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ImageDecoder.decodeBitmap(
                    ImageDecoder.createSource(context.contentResolver, this@toDownsampledBitmap)
                ) { decoder, info, _ ->
                    val longestSide = max(info.size.width, info.size.height)
                    var sampleSize = 1
                    while (longestSide / (sampleSize * 2) >= maxDimension) {
                        sampleSize *= 2
                    }
                    decoder.setTargetSampleSize(sampleSize)
                }
            } else {
                val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
                context.contentResolver.openInputStream(this@toDownsampledBitmap)?.use {
                    android.graphics.BitmapFactory.decodeStream(it, null, bounds)
                }
                val longestSide = max(bounds.outWidth, bounds.outHeight)
                var sampleSize = 1
                while (longestSide / (sampleSize * 2) >= maxDimension) {
                    sampleSize *= 2
                }
                val decodeOptions = android.graphics.BitmapFactory.Options().apply { inSampleSize = sampleSize }
                context.contentResolver.openInputStream(this@toDownsampledBitmap)?.use {
                    android.graphics.BitmapFactory.decodeStream(it, null, decodeOptions)
                }
            }
        }.getOrNull()
    }
