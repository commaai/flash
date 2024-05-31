<script>
    let { serial } = $props();
</script>

<div
    class="absolute bottom-0 m-0 lg:m-4 p-4 w-full sm:w-auto sm:min-w-[350px] sm:border sm:border-gray-200 dark:sm:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-md flex flex-row gap-2"
    style="left: '50%', transform: 'translate(-50%, -50%)'"
>
    <div class="flex flex-row gap-2">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 96 960 960"
            class="text-green-500 dark:text-[#51ff00]"
            height="24"
            width="24"
        >
            <path
                fill="currentColor"
                d="M480 976q-32 0-52-20t-20-52q0-22 11-40t31-29V724H302q-24 0-42-18t-18-42V555q-20-9-31-26.609-11-17.608-11-40.108Q200 456 220 436t52-20q32 0 52 20t20 52.411Q344 511 333 528.5T302 555v109h148V324h-80l110-149 110 149h-80v340h148V560h-42V416h144v144h-42v104q0 24-18 42t-42 18H510v111q19.95 10.652 30.975 29.826Q552 884 552 904q0 32-20 52t-52 20Z"
            />
        </svg>
        Device connected
    </div>
    <span class="text-gray-400">|</span>
    <div class="flex flex-row gap-2">
        <span>
            Serial:
            <span class="ml-2 font-mono">{serial || "unknown"}</span>
        </span>
    </div>
</div>
