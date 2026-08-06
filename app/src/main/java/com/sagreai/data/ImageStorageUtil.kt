package com.sagreai.data

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ImageStorageUtil @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val imagesDir: File
        get() = File(context.filesDir, "sagre_images").also { it.mkdirs() }

    suspend fun copyToInternal(uri: Uri): String? = withContext(Dispatchers.IO) {
        try {
            val fileName = "sagra_${UUID.randomUUID()}.jpg"
            val dest = File(imagesDir, fileName)
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(dest).use { output ->
                    input.copyTo(output)
                }
            }
            dest.toURI().toString()
        } catch (e: Exception) {
            android.util.Log.e("ImageStorageUtil", "copyToInternal failed", e)
            null
        }
    }

    suspend fun saveBitmap(bitmap: Bitmap): String? = withContext(Dispatchers.IO) {
        try {
            val fileName = "sagra_${UUID.randomUUID()}.jpg"
            val dest = File(imagesDir, fileName)
            FileOutputStream(dest).use { output ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, output)
            }
            dest.toURI().toString()
        } catch (e: Exception) {
            android.util.Log.e("ImageStorageUtil", "saveBitmap failed", e)
            null
        }
    }
}
