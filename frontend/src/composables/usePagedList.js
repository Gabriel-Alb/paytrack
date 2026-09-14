import { ref,watch,onBeforeUnmount,nextTick } from 'vue'
import { toast } from '@/composables/useToast'

export function usePagedList(fetchPage,query) {
  const items=ref([])
  const total=ref(0)
  const metadata=ref(null)
  const target=ref(null)
  const loading=ref(false)
  let page=0
  let generation=0
  let controller
  let observer

  async function load(reset=false) {
    if (!reset && (loading.value || items.value.length>=total.value)) return
    if (reset) {
      generation++
      controller?.abort()
      page=0
      items.value=[]
      total.value=0
      metadata.value=null
    }
    const current=generation
    controller=new AbortController()
    loading.value=true
    try {
      const result=await fetchPage({ ...query.value,page:page+1,limit:50 },controller.signal)
      if (current!==generation) return
      items.value=reset ? result.items : [...items.value,...result.items]
      total.value=result.total
      metadata.value=result
      page++
    } catch (error) {
      if (current===generation && error.name!=='AbortError') toast.error(error)
      return
    } finally {
      if (current===generation) loading.value=false
    }
    await nextTick()
    if (current===generation && page>0 && target.value && target.value.getBoundingClientRect().top<window.innerHeight+200 && items.value.length<total.value) load()
  }

  watch(query,() => load(true),{ immediate:true,deep:true })
  watch(target,(element) => {
    observer?.disconnect()
    if (!element) return
    observer=new IntersectionObserver(([entry]) => { if (entry.isIntersecting) load() },{ rootMargin:'200px' })
    observer.observe(element)
  })
  onBeforeUnmount(() => { generation++; controller?.abort(); observer?.disconnect() })
  return { items,total,metadata,target,loading,reload:() => load(true) }
}
