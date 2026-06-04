// JNI bridge for nodejs-mobile (v18.20.4)
// Uses the standard Node.js C++ Embedder API (node::Start) directly.
//
// IMPORTANT: node::Start() MUST be called synchronously on the calling thread
// (the Kotlin layer invokes us from a background thread). Do NOT wrap it in a
// std::thread here — libnode.so statically links its own libc++, while this
// library uses ANDROID_STL=none. Creating/managing a std::thread across that
// boundary corrupts pthread mutex state ("destroyed mutex" crash).
//
// We don't use rn-bridge style message passing — Kotlin polls
// http://localhost:3000 to detect when the HTTP server is up.

#include <jni.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <unistd.h>
#include <android/log.h>

// node::Start(int, char**) — exported by libnode.so (verified via llvm-nm).
namespace node {
    int Start(int argc, char* argv[]);
}

static const char *ADBTAG = "NODEJS-MOBILE";

// ---- Redirect stdout/stderr to logcat so server.js console.log is visible ----
static int   pipe_stdout[2];
static int   pipe_stderr[2];
static pthread_t thread_stdout;
static pthread_t thread_stderr;

static void *thread_stdout_func(void *) {
    ssize_t n;
    char buf[2048];
    while ((n = read(pipe_stdout[0], buf, sizeof buf - 1)) > 0) {
        if (buf[n - 1] == '\n') --n;
        buf[n] = 0;
        __android_log_write(ANDROID_LOG_INFO, ADBTAG, buf);
    }
    return nullptr;
}

static void *thread_stderr_func(void *) {
    ssize_t n;
    char buf[2048];
    while ((n = read(pipe_stderr[0], buf, sizeof buf - 1)) > 0) {
        if (buf[n - 1] == '\n') --n;
        buf[n] = 0;
        __android_log_write(ANDROID_LOG_ERROR, ADBTAG, buf);
    }
    return nullptr;
}

static int start_redirecting_stdout_stderr() {
    setvbuf(stdout, nullptr, _IONBF, 0);
    if (pipe(pipe_stdout) != 0) return -1;
    dup2(pipe_stdout[1], STDOUT_FILENO);

    setvbuf(stderr, nullptr, _IONBF, 0);
    if (pipe(pipe_stderr) != 0) return -1;
    dup2(pipe_stderr[1], STDERR_FILENO);

    if (pthread_create(&thread_stdout, nullptr, thread_stdout_func, nullptr) != 0) return -1;
    pthread_detach(thread_stdout);
    if (pthread_create(&thread_stderr, nullptr, thread_stderr_func, nullptr) != 0) return -1;
    pthread_detach(thread_stderr);
    return 0;
}

// libUV requires all arguments to live in one contiguous block of memory.
extern "C" JNIEXPORT jint JNICALL
Java_com_localgames_app_MainActivity_startNodeWithArguments(
        JNIEnv *env, jobject /*thiz*/, jobjectArray arguments) {

    jsize argc = env->GetArrayLength(arguments);

    // Compute total bytes needed for all args (incl. each '\0').
    int buffer_size = 0;
    for (int i = 0; i < argc; i++) {
        auto jstr = (jstring) env->GetObjectArrayElement(arguments, i);
        const char *s = env->GetStringUTFChars(jstr, nullptr);
        buffer_size += (int) strlen(s) + 1;
        env->ReleaseStringUTFChars(jstr, s);
        env->DeleteLocalRef(jstr);
    }

    char *args_buffer = (char *) calloc(buffer_size, sizeof(char));
    char **argv = (char **) malloc(sizeof(char *) * argc);
    char *cursor = args_buffer;

    for (int i = 0; i < argc; i++) {
        auto jstr = (jstring) env->GetObjectArrayElement(arguments, i);
        const char *s = env->GetStringUTFChars(jstr, nullptr);
        size_t len = strlen(s);
        strncpy(cursor, s, len);
        argv[i] = cursor;
        cursor += len + 1;  // calloc already zeroed the separator
        env->ReleaseStringUTFChars(jstr, s);
        env->DeleteLocalRef(jstr);
    }

    if (start_redirecting_stdout_stderr() == -1) {
        __android_log_write(ANDROID_LOG_ERROR, ADBTAG,
                            "Couldn't redirect stdout/stderr to logcat.");
    }

    __android_log_print(ANDROID_LOG_INFO, ADBTAG, "Calling node::Start with %d args", argc);

    // Synchronous — blocks this (Kotlin background) thread for the lifetime of Node.js.
    return (jint) node::Start(argc, argv);
}
